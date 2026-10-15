import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";
import Franchise from "@/models/Franchise";
import { getAuthInfo } from "@/lib/auth";
import { SESSION_COOKIE_OPTS } from "@/lib/cookie-opts";
import { validateCsrf } from "@/lib/csrf";
import mongoose from "mongoose";

const FRANCHISE_COOKIE = "em_franchise";
const FRANCHISE_NAME_COOKIE = "em_franchise_name";

function toObjectIdHex(value: unknown): string | null {
  if (value instanceof mongoose.Types.ObjectId) {
    return value.toHexString();
  }
  if (typeof value === "string" && mongoose.isValidObjectId(value)) {
    return new mongoose.Types.ObjectId(value).toHexString();
  }
  return null;
}

/** POST /api/stores/select — set the active store for this session */
export async function POST(request: NextRequest) {
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;

  const auth = await getAuthInfo();
  if (!auth) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { franchiseId?: string };
  const { franchiseId } = body;

  if (!franchiseId) {
    return NextResponse.json(
      { message: "franchiseId is required." },
      { status: 400 },
    );
  }

  await connectToDatabase();

  // Super admin can select any store; others can select stores they created or are assigned to.
  const franchise = await Franchise.findById(franchiseId)
    .select("name createdBy")
    .lean();
  if (!franchise) {
    return NextResponse.json(
      { message: "Franchise not found." },
      { status: 404 },
    );
  }

  if (auth.role !== "admin") {
    const user = await User.findById(auth.id).select("franchises").lean();
    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const assigned = (
      (user as { franchises?: unknown[] }).franchises ?? []
    ).some((id: unknown) => String(id) === franchiseId);

    // Compare createdBy ObjectId with auth.id string safely.
    const createdBy = (franchise as { createdBy?: unknown }).createdBy;
    const created = toObjectIdHex(createdBy) === auth.id;

    if (!assigned && !created) {
      return NextResponse.json(
        { message: "Access denied to this franchise." },
        { status: 403 },
      );
    }
  }

  // Derive the franchise name from the DB — never trust the client-provided value
  const franchiseName = (franchise as { name: string }).name;

  const response = NextResponse.json({ message: "Franchise selected." });
  response.cookies.set(FRANCHISE_COOKIE, franchiseId, SESSION_COOKIE_OPTS);
  response.cookies.set(
    FRANCHISE_NAME_COOKIE,
    franchiseName,
    SESSION_COOKIE_OPTS,
  );
  return response;
}
