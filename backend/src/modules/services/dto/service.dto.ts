import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested } from "class-validator";

export class ServiceHealthCheckDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  id?: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(500)
  address!: string;
}

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
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ServiceHealthCheckDto)
  healthChecks?: ServiceHealthCheckDto[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsString()
  clientId!: string;

  @IsNumber()
  @Min(0)
  monthlyValue!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(744)
  monthlyHours?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  hoursExpirePercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  hoursExpirationMonths?: number;

  @IsInt()
  @Min(1)
  @Max(31)
  paymentDay!: number;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  fileUrl?: string;

  @IsOptional()
  @IsString()
  fileName?: string;
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
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ServiceHealthCheckDto)
  healthChecks?: ServiceHealthCheckDto[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyValue?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(744)
  monthlyHours?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  hoursExpirePercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  hoursExpirationMonths?: number;

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

  @IsOptional()
  @IsString()
  fileUrl?: string;

  @IsOptional()
  @IsString()
  fileName?: string;
}

export class CreateServiceWorkLogDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  month!: string;

  @IsNumber()
  @Min(0.01)
  @Max(744)
  hours!: number;

  @IsString()
  @MaxLength(1000)
  description!: string;
}

export class UpdateServiceReportDto {
  @IsOptional()
  @IsIn(["OK", "ATTENTION", "FAILED", "NOT_APPLICABLE", ""])
  backupStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  backupNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  incidentNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  otherOccurrences?: string;
}
