import { NextRequest, NextResponse } from "next/server";
import { readJsonObject } from "@/lib/request-json";
import mongoose from "mongoose";
import Attendance, { type AttendanceStatus } from "@/models/Attendance";
import WeeklyRoster from "@/models/WeeklyRoster";
import User from "@/models/User";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthorizedStoreAdminId, requireAuth } from "@/lib/api-auth";
import { validateCsrf } from "@/lib/csrf";
import { isEmployeeActiveOn } from "@/lib/employee-status";
import { DATE_PATTERN } from "@/lib/date-utils";

const STATUSES = new Set<AttendanceStatus>(["Present", "Week Off", "Absent"]);

export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const auth = authResult;

  const params = new URL(request.url).searchParams;
  const franchiseId = await getAuthorizedStoreAdminId(auth, params.get("franchiseId"));
  const date = params.get("date");
  const from = params.get("from");
  const to = params.get("to");
  const hasDate = !!date && DATE_PATTERN.test(date);
  const hasRange = !!from && !!to && DATE_PATTERN.test(from) && DATE_PATTERN.test(to);
  if (!franchiseId || (!hasDate && !hasRange)) {
    return NextResponse.json({ message: "A valid store and date range are required." }, { status: 400 });
  }

  await connectToDatabase();
  if (hasRange) {
    const franchiseObjectId = new mongoose.Types.ObjectId(franchiseId);
    const rosters = await WeeklyRoster.find({
      franchise: franchiseObjectId,
      "entries.days.date": { $gte: from, $lte: to },
    }).lean();
    const defaults = rosters.flatMap((roster) =>
      roster.entries.flatMap((entry) =>
        entry.days
          .filter((day) => day.date >= from! && day.date <= to!)
          .map((day) => ({
            updateOne: {
              filter: {
                franchise: franchiseObjectId,
                employee: entry.employee,
                date: day.date,
              },
              update: {
                $setOnInsert: {
                  franchise: franchiseObjectId,
                  employee: entry.employee,
                  date: day.date,
                  status: (day.shift === "off" ? "Week Off" : "Present") as AttendanceStatus,
                  comment: "",
                  createdBy: roster.createdBy,
                },
              },
              upsert: true,
            },
          })),
      ),
    );
    // Roster defaults fill missing attendance only; existing admin corrections win.
    if (defaults.length > 0) await Attendance.bulkWrite(defaults);
  }
  const records = await Attendance.find({
    franchise: franchiseId,
    ...(hasDate ? { date } : { date: { $gte: from, $lte: to } }),
  }).lean();
  return NextResponse.json({
    records: records.map((record) => ({
      employeeId: String(record.employee),
      date: record.date,
      status: record.status,
      comment: record.comment ?? "",
    })),
  });
}

export async function PUT(request: NextRequest) {
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const auth = authResult;

  const jsonBody = await readJsonObject<{
    franchiseId?: string;
    date?: string;
    records?: Array<{ employeeId?: string; status?: string; comment?: string }>;
  }>(request);
  if (jsonBody.response) return jsonBody.response;
  const body = jsonBody.body;
  const franchiseId = await getAuthorizedStoreAdminId(auth, body.franchiseId ?? null);
  if (!franchiseId || !body.date || !DATE_PATTERN.test(body.date) || !Array.isArray(body.records)) {
    return NextResponse.json({ message: "A valid store, date, and records are required." }, { status: 400 });
  }
  if (body.records.length > 500) {
    return NextResponse.json({ message: "Too many attendance records." }, { status: 400 });
  }

  const employeeIds = body.records.map((record) => record.employeeId ?? "");
  if (employeeIds.some((id) => !mongoose.isValidObjectId(id))) {
    return NextResponse.json({ message: "Each employee must be valid." }, { status: 400 });
  }
  if (new Set(employeeIds).size !== employeeIds.length) {
    return NextResponse.json({ message: "Each employee can only be marked once per date." }, { status: 400 });
  }
  if (body.records.some((record) => !STATUSES.has(record.status as AttendanceStatus))) {
    return NextResponse.json({ message: "Each attendance status must be valid." }, { status: 400 });
  }

  const validRecords = body.records as Array<{
    employeeId: string;
    status: AttendanceStatus;
    comment?: string;
  }>;
  const attendanceDate = body.date as string;

  await connectToDatabase();
  const employees = await User.find({
    _id: { $in: employeeIds },
    role: "employee",
    franchises: franchiseId,
  }).select("_id dateOfJoining archivedAt isActive").lean();
  // Historical attendance may be entered later, so validate employment against
  // the requested attendance date rather than the current date.
  const validEmployeeIds = new Set(
    employees
      .filter((employee) => isEmployeeActiveOn(employee, attendanceDate))
      .map((employee) => String(employee._id)),
  );
  const skippedCount = employeeIds.filter((id) => !validEmployeeIds.has(id)).length;
  const recordsToSave = validRecords.filter((record) => validEmployeeIds.has(record.employeeId));

  const actorId = mongoose.isValidObjectId(auth.id)
    ? new mongoose.Types.ObjectId(auth.id)
    : null;
  if (!actorId) {
    return NextResponse.json({ message: "A valid authenticated user is required." }, { status: 400 });
  }
  const franchiseObjectId = new mongoose.Types.ObjectId(franchiseId);

  const operations = recordsToSave.map((record) => ({
    updateOne: {
      filter: {
        franchise: franchiseObjectId,
        employee: new mongoose.Types.ObjectId(record.employeeId),
        date: attendanceDate,
      },
      update: {
        $set: {
          status: record.status,
          comment: record.comment?.trim() ?? "",
          createdBy: actorId,
        },
      },
      upsert: true,
    },
  }));
  // Upserts make saving the same employee/date again an update, not a duplicate.
  if (operations.length > 0) await Attendance.bulkWrite(operations);

  return NextResponse.json({
    message:
      skippedCount > 0
        ? `Attendance saved for ${recordsToSave.length} employee(s). ${skippedCount} employee(s) weren't active on this date and were skipped.`
        : "Attendance saved successfully.",
    skippedCount,
  });
}

export async function DELETE(request: NextRequest) {
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const auth = authResult;

  const params = new URL(request.url).searchParams;
  const franchiseId = await getAuthorizedStoreAdminId(auth, params.get("franchiseId"));
  const date = params.get("date");
  const employeeId = params.get("employeeId");
  if (!franchiseId || !date || !DATE_PATTERN.test(date) || !employeeId || !mongoose.isValidObjectId(employeeId)) {
    return NextResponse.json({ message: "A valid store, date, and employee are required." }, { status: 400 });
  }

  await connectToDatabase();
  const deleted = await Attendance.findOneAndDelete({
    franchise: franchiseId,
    employee: employeeId,
    date,
  }).lean();
  if (!deleted) {
    return NextResponse.json({ message: "Attendance record not found." }, { status: 404 });
  }

  return NextResponse.json({ message: "Attendance record removed." });
}
