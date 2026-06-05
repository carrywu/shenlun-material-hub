import { NextRequest, NextResponse } from "next/server";
import { getAuthConfig, verifyPassword, signJWT } from "@/lib/auth";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    const authConfigResult = getAuthConfig();
    if (!authConfigResult.ok) {
      await logger.error(authConfigResult.message, "AUTH");
      return NextResponse.json({ error: authConfigResult.message }, { status: 500 });
    }

    const { username: expectedUsername, passwordHash, jwtSecret, usingDefaults } =
      authConfigResult.config;

    if (usingDefaults) {
      await logger.warn(
        "Admin auth is using development fallback credentials. Do not use this setup in production.",
        "AUTH"
      );
    }

    if (username !== expectedUsername) {
      await logger.warn(`Failed login attempt: Invalid username "${username}"`, "AUTH");
      return NextResponse.json({ error: "用户名或密码错误" }, { status: 401 });
    }

    const isPasswordCorrect = await verifyPassword(password, passwordHash);
    if (!isPasswordCorrect) {
      await logger.warn(`Failed login attempt: Incorrect password for user "${username}"`, "AUTH");
      return NextResponse.json({ error: "用户名或密码错误" }, { status: 401 });
    }

    // Generate JWT token
    const token = await signJWT({ username }, jwtSecret);

    // Set token in Cookie
    const response = NextResponse.json({ success: true, message: "登录成功" });
    
    // Cookie details
    const isProd = process.env.NODE_ENV === "production";
    response.headers.append(
      "Set-Cookie",
      `auth_token=${token}; Path=/; HttpOnly; ${isProd ? "Secure;" : ""} SameSite=Strict; Max-Age=86400`
    );

    await logger.info(`Admin user "${username}" logged in successfully.`, "AUTH");
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    const detail = error instanceof Error ? error.stack : undefined;
    await logger.error(`Error during login processing: ${message}`, "AUTH", detail);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
