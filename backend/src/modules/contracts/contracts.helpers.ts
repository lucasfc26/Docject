import { ContractParticipantRole } from "@prisma/client";

type ContractParticipantRow = {
  role: ContractParticipantRole;
  witnessIndex?: number | null;
  signedAt?: Date | null;
  user?: { id: string; name: string; email: string; cpf?: string | null } | null;
};

export function participantLabel(role: ContractParticipantRole | string, witnessIndex?: number | null) {
  if (role === "CONTRACTING_PARTY") return "Contratante";
  if (role === "CONTRACTOR") return "Contratado";
  if (role === "WITNESS") return witnessIndex ? `Testemunha ${witnessIndex}` : "Testemunha";
  return role;
}

export function participantSignLabel(role: ContractParticipantRole | string, witnessIndex?: number | null) {
  if (role === "CONTRACTING_PARTY") return "Assinou";
  if (role === "CONTRACTOR") return "Assinou como contratado";
  if (role === "WITNESS") return witnessIndex ? `Assinou como testemunha ${witnessIndex}` : "Assinou como testemunha";
  return "Assinou";
}

export function listContractParticipants(participants: ContractParticipantRow[]) {
  const order = { CONTRACTING_PARTY: 0, CONTRACTOR: 1, WITNESS: 2 } as const;
  return [...participants].sort((left, right) => {
    const roleDiff = order[left.role] - order[right.role];
    if (roleDiff !== 0) return roleDiff;
    return (left.witnessIndex ?? 0) - (right.witnessIndex ?? 0);
  });
}

export function allParticipantsSigned(participants: Array<{ signedAt?: Date | null }>) {
  return participants.length > 0 && participants.every((participant) => participant.signedAt);
}

export function canManageContractParticipants(
  user: { sub: string; role: string } | undefined,
  contract: { createdById?: string | null; participants: Array<{ userId: string; role: ContractParticipantRole }> }
) {
  if (!user) return false;
  if (user.role === "ADMIN" || user.role === "MANAGER" || user.role === "FINANCIAL") return true;
  if (contract.createdById === user.sub) return true;
  return contract.participants.some(
    (participant) => participant.userId === user.sub && participant.role === "CONTRACTING_PARTY"
  );
}

export function nextWitnessIndex(participants: Array<{ role: ContractParticipantRole; witnessIndex?: number | null }>) {
  const indexes = participants
    .filter((participant) => participant.role === "WITNESS")
    .map((participant) => participant.witnessIndex ?? 0);
  return indexes.length ? Math.max(...indexes) + 1 : 1;
}
