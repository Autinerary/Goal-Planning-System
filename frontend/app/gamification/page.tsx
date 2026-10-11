import GamificationDashboard from "../components/GamificationDashboard";
import BackButton from "../components/BackButton";

export default function GamificationPage(){
    return (
        <main className="relative min-h-screen bg-slate-900 py-8 flex justify-center items-center">
      <BackButton className="absolute left-4 top-4" />
      <GamificationDashboard />
      </main>
    )
}