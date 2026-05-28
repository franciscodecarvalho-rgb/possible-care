import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AuthGuard from "./components/AuthGuard";
import Index from "./pages/Index";
import Login from "./pages/Login";
import AnalisePF from "./pages/AnalisePF";
import AnalisePJ from "./pages/AnalisePJ";
import AnaliseNova from "./pages/AnaliseNova";
import FiadorNovo from "./pages/FiadorNovo";
import Preview from "./pages/Preview";
import Resultado from "./pages/Resultado";
import Historico from "./pages/Historico";
import Configuracoes from "./pages/Configuracoes";
import ApiKeys from "./pages/ApiKeys";
import Clientes from "./pages/Clientes";
import ClienteFormulario from "./pages/ClienteFormulario";
import ClienteFicha from "./pages/ClienteFicha";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<AuthGuard><Index /></AuthGuard>} />
          <Route path="/analise/nova" element={<AuthGuard><AnaliseNova /></AuthGuard>} />
          <Route path="/analise/:analiseId/fiador/novo" element={<AuthGuard><FiadorNovo /></AuthGuard>} />
          <Route path="/analise/pf" element={<AuthGuard><AnalisePF /></AuthGuard>} />
          <Route path="/analise/pj" element={<AuthGuard><AnalisePJ /></AuthGuard>} />
          <Route path="/preview" element={<AuthGuard><Preview /></AuthGuard>} />
          <Route path="/resultado" element={<AuthGuard><Resultado /></AuthGuard>} />
          <Route path="/historico" element={<AuthGuard><Historico /></AuthGuard>} />
          <Route path="/configuracoes" element={<AuthGuard><Configuracoes /></AuthGuard>} />
          <Route path="/api-keys" element={<AuthGuard><ApiKeys /></AuthGuard>} />
          <Route path="/clientes" element={<AuthGuard><Clientes /></AuthGuard>} />
          <Route path="/clientes/novo" element={<AuthGuard><ClienteFormulario /></AuthGuard>} />
          <Route path="/clientes/:id" element={<AuthGuard><ClienteFicha /></AuthGuard>} />
          <Route path="/clientes/:id/editar" element={<AuthGuard><ClienteFormulario /></AuthGuard>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
