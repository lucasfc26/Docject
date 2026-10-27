import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

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

  /** Issue the NFS-e automatically once the charge is paid. */
  @IsOptional()
  @IsBoolean()
  nfseEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  nfseServiceCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  nfseServiceName?: string;

  /** ISS rate in percent (e.g. 2 for 2%). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  nfseIssRate?: number;

  @IsOptional()
  @IsBoolean()
  nfseRetainIss?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  nfseObservations?: string;
}

export class ChargeTransactionDto {
  @IsIn(["PIX", "BOLETO", "UNDEFINED"])
  billingType!: "PIX" | "BOLETO" | "UNDEFINED";
}
