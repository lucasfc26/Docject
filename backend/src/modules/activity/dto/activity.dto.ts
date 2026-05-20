import { IsObject, IsOptional, IsString } from "class-validator";

export class CreateActivityLogDto {
  @IsString()
  action!: string;

  @IsString()
  actor!: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
