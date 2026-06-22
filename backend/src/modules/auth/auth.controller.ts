import { Body, Controller, Get, Post, Req, UnauthorizedException } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AuthenticatedRequest } from "../../common/current-user";
import { Public } from "../../common/public.decorator";
import { ForgotPasswordDto, LoginDto, LogoutDto, RefreshTokenDto, RegisterDto, ResetPasswordDto, ChangePasswordDto } from "./dto/auth.dto";
import { AuthService } from "./auth.service";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("login")
  login(@Body() body: LoginDto) {
    return this.auth.login(body.email, body.password);
  }

  @Public()
  @Post("register")
  register(@Body() body: RegisterDto) {
    return this.auth.register(body.name, body.email, body.password);
  }

  @Public()
  @Post("refresh")
  refresh(@Body() body: RefreshTokenDto) {
    return this.auth.refresh(body.refreshToken);
  }

  @Post("logout")
  logout(@Body() body: LogoutDto) {
    return this.auth.logout(body.refreshToken);
  }

  @Public()
  @Post("forgot-password")
  forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.auth.forgotPassword(body.email);
  }

  @Public()
  @Post("reset-password")
  resetPassword(@Body() body: ResetPasswordDto) {
    return this.auth.resetPassword(body.email, body.code, body.password);
  }

  @Post("change-password")
  changePassword(@Req() request: AuthenticatedRequest, @Body() body: ChangePasswordDto) {
    const userId = request.user?.sub;
    if (!userId) throw new UnauthorizedException();
    return this.auth.changePassword(userId, body.currentPassword, body.password);
  }

  @Get("me")
  me(@Req() request: AuthenticatedRequest) {
    return this.auth.me(request.user?.sub ?? "");
  }
}
