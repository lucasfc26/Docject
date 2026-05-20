import { Activity, Briefcase, CalendarDays, CircleDollarSign, FileSignature, Handshake, LayoutDashboard, Settings, UserCog, UsersRound } from "lucide-react";

export const navItems = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { label: "Clientes", path: "/clients", icon: UsersRound },
  { label: "Projetos", path: "/projects", icon: Briefcase },
  { label: "Servicos", path: "/services", icon: Handshake },
  { label: "Contratos", path: "/contracts", icon: FileSignature },
  { label: "Financeiro", path: "/financial", icon: CircleDollarSign },
  { label: "Agenda", path: "/agenda", icon: CalendarDays },
  { label: "Recursos", path: "/resources", icon: UserCog },
  { label: "Portal Cliente", path: "/client/dashboard", icon: Activity },
  { label: "Configurações", path: "/settings", icon: Settings }
];

export const kpis = [
  { label: "Clientes", value: "24", trend: "ativos", tone: "blue" },
  { label: "Projetos ativos", value: "18", trend: "62% medio", tone: "blue" },
  { label: "Receita mes", value: "R$ 86k", trend: "8% mais que o mes anterior", tone: "green" },
  { label: "Receita ano", value: "R$ 486k", trend: "12% mais que o ano anterior", tone: "green" }
];

export const projects = [
  { name: "Quantum Nexus Rewrite", client: "Alpha Core", status: "Em andamento", progress: 75, due: "24 out 2026", budget: "R$ 1,2M", owner: "Elena R." },
  { name: "Docject Storage V2", client: "Omega Corp", status: "Em risco", progress: 42, due: "12 nov 2026", budget: "R$ 420k", owner: "Marcus T." },
  { name: "Orion Marketing Launch", client: "Orion Labs", status: "Planejamento", progress: 18, due: "05 jan 2027", budget: "R$ 260k", owner: "Sarah J." }
];

export const clients = [
  { name: "Alpha Core", owner: "Elena R.", health: "Excelente", revenue: "R$ 1,2M", projects: 4 },
  { name: "Omega Corp", owner: "Marcus T.", health: "Atenção", revenue: "R$ 420k", projects: 2 },
  { name: "Orion Labs", owner: "Sarah J.", health: "Estável", revenue: "R$ 260k", projects: 3 }
];

export const transactions = [
  { id: "TRX-9012", entity: "Omega Corp Solutions", date: "12 nov", amount: "+R$ 145.000", status: "Pago" },
  { id: "TRX-9013", entity: "Alpha Core", date: "18 nov", amount: "+R$ 85.000", status: "Pendente" },
  { id: "TRX-9014", entity: "Infra Cloud", date: "20 nov", amount: "-R$ 22.400", status: "Agendado" }
];

export const timeline = [
  { label: "Descoberta", date: "15 out", done: true },
  { label: "Design", date: "02 nov", done: true },
  { label: "Sprint 1", date: "Agora", done: false, active: true },
  { label: "UAT", date: "28 nov", done: false },
  { label: "Lançamento", date: "05 dez", done: false }
];

export const contracts = [
  { title: "MSA Alpha Core", version: "v3", status: "Assinado", value: "R$ 780k" },
  { title: "SOW Storage V2", version: "v1", status: "Enviado", value: "R$ 420k" },
  { title: "NDA Orion Labs", version: "v2", status: "Rascunho", value: "R$ 0" }
];
