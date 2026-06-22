import { IsEmail, IsOptional, IsString, Matches, MinLength } from "class-validator";

export const passwordRuleMessage =
  "A senha deve ter no minimo 6 caracteres e pelo menos um caractere especial.";
export const passwordSpecialCharacterPattern = /[^A-Za-z0-9]/;

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}

export class RegisterDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  @Matches(passwordSpecialCharacterPattern, { message: passwordRuleMessage })
  password!: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken!: string;
}

export class LogoutDto {
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: "Informe o codigo de 6 digitos enviado por e-mail." })
  code!: string;

  @IsString()
  @MinLength(6)
  @Matches(passwordSpecialCharacterPattern, { message: passwordRuleMessage })
  password!: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(6)
  currentPassword!: string;

  @IsString()
  @MinLength(6)
  @Matches(passwordSpecialCharacterPattern, { message: passwordRuleMessage })
  password!: string;
}
