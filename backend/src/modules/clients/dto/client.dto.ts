import { IsEmail, IsIn, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateClientDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  segment?: string;

  @IsOptional()
  @IsIn(["EXCELLENT", "ATTENTION", "STABLE"])
  health?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  revenue?: number;
}

export class UpdateClientDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  segment?: string;

  @IsOptional()
  @IsIn(["EXCELLENT", "ATTENTION", "STABLE"])
  health?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  revenue?: number;
}

export class CreateClientContactDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
