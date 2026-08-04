import { Link } from "react-router-dom";
import { ArrowLeft, Clapperboard } from "lucide-react";
import loginImage from "../../asset/login.jpg";

export const authInputClass =
  "mt-2 h-12 w-full rounded-lg border border-stone-100/10 bg-[#10100f] px-4 text-sm text-stone-100 outline-none transition placeholder:text-stone-600 focus:border-red-500/70 focus:ring-4 focus:ring-red-500/10";

export const authButtonClass =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-5 text-sm font-bold text-white transition hover:bg-red-500 focus:outline-none focus:ring-4 focus:ring-red-500/20 disabled:cursor-not-allowed disabled:opacity-50";

export function AuthField({ label, icon: Icon, ...inputProps }) {
  return (
    <label className="block text-sm font-semibold text-stone-300">
      <span className="flex items-center gap-2">
        {Icon ? <Icon size={15} className="text-amber-400" /> : null}
        {label}
      </span>
      <input {...inputProps} className={authInputClass} />
    </label>
  );
}

export default function AuthLayout({ eyebrow, title, description, children, footer, panelImage = loginImage }) {
  return (
    <section className="relative isolate min-h-[calc(100vh-5rem)] overflow-hidden px-4 py-10 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/4 top-0 h-72 w-72 rounded-full bg-red-600/10 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-72 w-72 rounded-full bg-amber-500/5 blur-3xl" />
      </div>

      <div className="mx-auto grid min-h-[38rem] max-w-5xl overflow-hidden rounded-2xl border border-stone-100/10 bg-[#151513]/95 shadow-2xl shadow-black/40 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative hidden min-h-full overflow-hidden lg:block">
          <img src={panelImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-red-950/20" />
          <div className="relative flex h-full flex-col justify-between p-10">
            <Link to="/" className="inline-flex w-fit items-center gap-2 text-sm font-bold text-stone-100">
              <Clapperboard size={20} className="text-red-400" />
              ANIWIKI
            </Link>
            <div>
              <h2 className="max-w-sm text-3xl font-black leading-tight text-white">
                좋아하는 작품을 발견하고 이야기를 나눠보세요.
              </h2>
              <p className="mt-4 max-w-sm text-sm leading-6 text-stone-300">
                최신 애니 정보부터 캐릭터, 댓글과 추천까지 하나의 공간에서 만나볼 수 있습니다.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center px-6 py-10 sm:px-10 lg:px-12">
          <div className="w-full">
            <Link to="/" className="mb-8 inline-flex items-center gap-2 text-xs font-semibold text-stone-500 transition hover:text-amber-300">
              <ArrowLeft size={15} />
              메인으로 돌아가기
            </Link>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-red-400">{eyebrow}</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-stone-50">{title}</h1>
            <p className="mt-3 text-sm leading-6 text-stone-400">{description}</p>
            <div className="mt-8">{children}</div>
            {footer ? <div className="mt-7 border-t border-stone-100/10 pt-6 text-center text-sm text-stone-500">{footer}</div> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
