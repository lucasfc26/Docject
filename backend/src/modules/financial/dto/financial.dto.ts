import { IsDateString, IsIn, IsNumber, IsOptional, IsString } from "class-validator";

export class CreateFinancialTransactionDto {
  @IsString()
  entity!: string;

  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsIn(["REVENUE", "EXPENSE"])
  kind?: string;

  @IsOptional()
  @IsIn(["PENDING", "PAID", "OVERDUE", "CANCELLED"])
  status?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class UpdateFinancialTransactionDto {
  @IsOptional()
  @IsString()
  entity?: string;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsIn(["REVENUE", "EXPENSE"])
  kind?: string;

  @IsOptional()
  @IsIn(["PENDING", "PAID", "OVERDUE", "CANCELLED"])
  status?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
