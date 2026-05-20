import { IsOptional, IsString } from "class-validator";

export class CreateFileUploadDto {
  @IsString()
  filename!: string;

  @IsString()
  url!: string;

  @IsOptional()
  @IsString()
  mimeType?: string;
}
