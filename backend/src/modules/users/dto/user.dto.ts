import { IsEmail, IsIn, IsOptional, IsString, Matches, MinLength } from "class-validator";
import {
  passwordRuleMessage,
  passwordSpecialCharacterPattern,
} from "../../auth/dto/auth.dto";

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsString()
  @MinLength(6)
  @Matches(passwordSpecialCharacterPattern, { message: passwordRuleMessage })
  password!: string;

  @IsOptional()
  @IsIn(["ADMIN", "MANAGER", "FINANCIAL", "CLIENT"])
  role?: string;

  @IsOptional()
  @IsString()
  clientId?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  @Matches(passwordSpecialCharacterPattern, { message: passwordRuleMessage })
  password?: string;

  @IsOptional()
  @IsIn(["ADMIN", "MANAGER", "FINANCIAL", "CLIENT"])
  role?: string;

  @IsOptional()
  @IsString()
  clientId?: string | null;
}
