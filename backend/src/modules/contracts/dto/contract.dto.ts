import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min, ValidateIf } from "class-validator";

export class CreateContractDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsString()
  contractingPartyId!: string;
}

export class UpdateContractDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number;

  @IsOptional()
  @IsString()
  clientId?: string | null;
}

export class AddContractParticipantDto {
  @ValidateIf((body) => !body.email)
  @IsString()
  userId?: string;

  @ValidateIf((body) => !body.userId)
  @IsString()
  email?: string;

  @IsIn(["CONTRACTOR", "WITNESS"])
  role!: "CONTRACTOR" | "WITNESS";
}

export class CreateContractVersionDto {
  @IsInt()
  @Min(1)
  version!: number;

  @IsOptional()
  @IsString()
  fileUrl?: string;
}

export class SignContractDto {
  @IsString()
  password!: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  geoAccuracy?: number;
}

export class ValidateContractDto {
  @IsString()
  code!: string;
}
