import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

export class SaveAsaasCredentialDto {
  @IsIn(["PRODUCTION", "SANDBOX"])
  environment!: "PRODUCTION" | "SANDBOX";

  /** Omitted when only the preferences change; the stored key is kept. */
  @IsOptional()
  @IsString()
  @MinLength(20)
  @MaxLength(500)
  apiKey?: string;

  /** Empty string removes the stored webhook token. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  webhookToken?: string;

  @IsOptional()
  @IsBoolean()
  autoCharge?: boolean;

  @IsOptional()
  @IsIn(["PIX", "BOLETO", "UNDEFINED"])
  defaultBillingType?: "PIX" | "BOLETO" | "UNDEFINED";

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  chargeDaysBefore?: number;
}

export class ChargeTransactionDto {
  @IsIn(["PIX", "BOLETO", "UNDEFINED"])
  billingType!: "PIX" | "BOLETO" | "UNDEFINED";
}
