import { IsIn, IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateContractDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number;

  @IsOptional()
  @IsIn(["DRAFT", "SENT", "SIGNED", "CANCELLED"])
  status?: string;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  contractingPartyId?: string;

  @IsOptional()
  @IsString()
  contractorId?: string;

  @IsOptional()
  @IsString()
  witnessOneId?: string;

  @IsOptional()
  @IsString()
  witnessTwoId?: string;
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
  @IsIn(["DRAFT", "SENT", "SIGNED", "CANCELLED"])
  status?: string;

  @IsOptional()
  @IsString()
  clientId?: string | null;

  @IsOptional()
  @IsString()
  contractingPartyId?: string | null;

  @IsOptional()
  @IsString()
  contractorId?: string | null;

  @IsOptional()
  @IsString()
  witnessOneId?: string | null;

  @IsOptional()
  @IsString()
  witnessTwoId?: string | null;
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
}

export class ValidateContractDto {
  @IsString()
  code!: string;
}
