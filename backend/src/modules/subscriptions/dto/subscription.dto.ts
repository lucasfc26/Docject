import { IsIn, IsOptional, IsString } from "class-validator";

export class CheckoutSubscriptionDto {
  @IsIn(["MONTHLY", "YEARLY"])
  plan!: "MONTHLY" | "YEARLY";

  @IsOptional()
  @IsString()
  cpfCnpj?: string;
}
