import { IsEmail, IsIn, IsOptional, IsString } from "class-validator";

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
  cpf?: string;

  @IsOptional()
  @IsString()
  address?: string;

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
  cpf?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsIn(["ADMIN", "MANAGER", "FINANCIAL", "CLIENT"])
  role?: string;

  @IsOptional()
  @IsString()
  clientId?: string | null;
}
