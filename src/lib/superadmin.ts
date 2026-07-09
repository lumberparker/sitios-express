import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

/** Doble verificación de rol (además del middleware). */
export async function requireSuperAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return { error: NextResponse.json({ error: "Sin permiso" }, { status: 403 }) };
  }
  return { session };
}
