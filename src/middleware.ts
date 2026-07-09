import { withAuth } from "next-auth/middleware";

// Solo el panel super admin requiere sesión. Los clientes no tienen cuenta:
// acceden a su sitio con la editKey de la URL (/builder/<key>).
export default withAuth({
  callbacks: {
    authorized({ token }) {
      return token?.role === "SUPER_ADMIN";
    },
  },
});

export const config = {
  matcher: ["/superadmin/:path*", "/api/superadmin/:path*"],
};
