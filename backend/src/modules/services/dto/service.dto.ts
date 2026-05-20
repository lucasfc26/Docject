import { IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

export class CreateServiceDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(["EXCELLENT", "ATTENTION", "STABLE"])
  frontendHealth?: string;

  @IsOptional()
  @IsIn(["EXCELLENT", "ATTENTION", "STABLE"])
  backendHealth?: string;

  @IsOptional()
  @IsIn(["EXCELLENT", "ATTENTION", "STABLE"])
  databaseHealth?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsString()
  clientId!: string;

  @IsNumber()
  @Min(0)
  monthlyValue!: number;

  @IsInt()
  @Min(1)
  @Max(31)
  paymentDay!: number;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateServiceDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(["EXCELLENT", "ATTENTION", "STABLE"])
  frontendHealth?: string;

  @IsOptional()
  @IsIn(["EXCELLENT", "ATTENTION", "STABLE"])
  backendHealth?: string;

  @IsOptional()
  @IsIn(["EXCELLENT", "ATTENTION", "STABLE"])
  databaseHealth?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyValue?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  paymentDay?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
