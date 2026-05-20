import { IsOptional, IsString } from "class-validator";

export class CreateNotificationDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  type?: string;
}
