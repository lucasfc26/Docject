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
}

export class CreateContractVersionDto {
  @IsInt()
  @Min(1)
  version!: number;

  @IsOptional()
  @IsString()
  fileUrl?: string;
}
