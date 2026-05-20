import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class CreateResourceDto {
  @IsString()
  name!: string;

  @IsString()
  role!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  capacity?: number;
}

export class UpdateResourceDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  capacity?: number;
}
