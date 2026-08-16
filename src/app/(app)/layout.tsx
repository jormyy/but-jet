import { Nav } from '@/components/nav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-lg mx-auto pb-24">
      {children}
      <Nav />
    </div>
  )
}
