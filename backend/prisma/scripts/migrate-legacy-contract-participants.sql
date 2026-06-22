-- Executar ANTES do prisma db push se o banco ainda tiver as colunas antigas de participantes.
-- Preserva contratante, contratado e testemunhas na tabela ContractParticipant.

CREATE TABLE IF NOT EXISTS "ContractParticipant" (
  id TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  role TEXT NOT NULL,
  "witnessIndex" INTEGER,
  "signedAt" TIMESTAMP(3),
  "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "addedById" TEXT,
  CONSTRAINT "ContractParticipant_pkey" PRIMARY KEY (id)
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Contract'
      AND column_name = 'contractingPartyId'
  ) THEN
    INSERT INTO "ContractParticipant" (id, "contractId", "userId", role, "witnessIndex", "signedAt", "addedAt")
    SELECT gen_random_uuid()::text, c.id, c."contractingPartyId", 'CONTRACTING_PARTY', NULL, c."contractingPartySignedAt", COALESCE(c."createdAt", NOW())
    FROM "Contract" c
    WHERE c."contractingPartyId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "ContractParticipant" p
        WHERE p."contractId" = c.id AND p."userId" = c."contractingPartyId"
      );

    INSERT INTO "ContractParticipant" (id, "contractId", "userId", role, "witnessIndex", "signedAt", "addedAt")
    SELECT gen_random_uuid()::text, c.id, c."contractorId", 'CONTRACTOR', NULL, c."contractorSignedAt", COALESCE(c."createdAt", NOW())
    FROM "Contract" c
    WHERE c."contractorId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "ContractParticipant" p
        WHERE p."contractId" = c.id AND p."userId" = c."contractorId"
      );

    INSERT INTO "ContractParticipant" (id, "contractId", "userId", role, "witnessIndex", "signedAt", "addedAt")
    SELECT gen_random_uuid()::text, c.id, c."witnessOneId", 'WITNESS', 1, c."witnessOneSignedAt", COALESCE(c."createdAt", NOW())
    FROM "Contract" c
    WHERE c."witnessOneId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "ContractParticipant" p
        WHERE p."contractId" = c.id AND p."userId" = c."witnessOneId"
      );

    INSERT INTO "ContractParticipant" (id, "contractId", "userId", role, "witnessIndex", "signedAt", "addedAt")
    SELECT gen_random_uuid()::text, c.id, c."witnessTwoId", 'WITNESS', 2, c."witnessTwoSignedAt", COALESCE(c."createdAt", NOW())
    FROM "Contract" c
    WHERE c."witnessTwoId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "ContractParticipant" p
        WHERE p."contractId" = c.id AND p."userId" = c."witnessTwoId"
      );
  END IF;
END $$;
