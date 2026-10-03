import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto my-12 flex max-w-xl flex-col items-center justify-center rounded-lg border border-neutral-200 bg-white p-8 text-center md:p-12 dark:border-neutral-800 dark:bg-black">
      <h1 className="text-6xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-100">
        404
      </h1>
      <h2 className="mt-4 text-2xl font-bold text-neutral-800 dark:text-neutral-200">
        Sayfa Bulunamadı
      </h2>
      <p className="mt-2 text-neutral-600 dark:text-neutral-400">
        Aradığınız sayfa mevcut değil veya taşınmış olabilir.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center justify-center rounded-full bg-blue-600 px-6 py-3 text-sm font-medium text-white transition hover:bg-blue-700"
      >
        Ana Sayfaya Dön
      </Link>
    </div>
  );
}
