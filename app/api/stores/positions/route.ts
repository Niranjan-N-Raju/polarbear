import { NextRequest, NextResponse } from "next/server";
import Franchise from "@/models/Franchise";
import User from "@/models/User";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthorizedStoreId, requireAuth } from "@/lib/api-auth";
import { validateCsrf } from "@/lib/csrf";
import { DEFAULT_POSITION_OPTIONS } from "@/lib/employee-positions";

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const franchiseId = await getAuthorizedStoreId(
    auth,
    new URL(request.url).searchParams.get("franchiseId"),
  );
  if (!franchiseId) return NextResponse.json({ message: "A valid store is required." }, { status: 400 });

  await connectToDatabase();
  const store = await Franchise.findById(franchiseId).select("positions");
  if (!store) return NextResponse.json({ message: "Store not found." }, { status: 404 });
  return NextResponse.json({ positions: store.positions ?? DEFAULT_POSITION_OPTIONS });
}

export async function PUT(request: NextRequest) {
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!["admin", "sub_admin", "franchise_admin"].includes(auth.role)) {
    return NextResponse.json({ message: "You are not allowed to configure positions." }, { status: 403 });
  }

  const body = (await request.json()) as { franchiseId?: string; positions?: unknown };
  const franchiseId = await getAuthorizedStoreId(auth, body.franchiseId);
  if (!franchiseId || !Array.isArray(body.positions) || body.positions.length > 30) {
    return NextResponse.json({ message: "A valid store and up to 30 positions are required." }, { status: 400 });
  }
  const positions = body.positions.map((position) => typeof position === "string" ? position.trim() : "");
  if (positions.some((position) => !position || position.length > 60)) {
    return NextResponse.json({ message: "Each position must be 1 to 60 characters." }, { status: 400 });
  }
  if (new Set(positions.map((position) => position.toLowerCase())).size !== positions.length) {
    return NextResponse.json({ message: "Position names must be unique within this store." }, { status: 409 });
  }

  await connectToDatabase();
  const store = await Franchise.findById(franchiseId).select("positions");
  if (!store) return NextResponse.json({ message: "Store not found." }, { status: 404 });
  const removedPositions = (store.positions ?? DEFAULT_POSITION_OPTIONS).filter(
    (position) => !positions.some((next) => next.toLowerCase() === position.toLowerCase()),
  );
  if (removedPositions.length > 0) {
    const usedPosition = await User.exists({
      franchises: franchiseId,
      role: "employee",
      position: { $in: removedPositions },
    });
    if (usedPosition) {
      return NextResponse.json(
        { message: "A position is assigned to an employee. Reassign those employees before removing it." },
        { status: 409 },
      );
    }
  }

  store.positions = positions;
  await store.save();
  return NextResponse.json({ message: "Position options saved.", positions: store.positions });
}