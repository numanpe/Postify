import { requireCompany } from "@/lib/session";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { PromoCodeForm } from "@/components/growth/promo-code-form";
import { PromoCodeRow } from "@/components/growth/promo-code-row";

const PROMO_CODES_LIMIT = 30;

export default async function PromoCodesPage() {
  const { company } = await requireCompany();
  const dict = getDictionary(await getLocale()).promoCodes;

  const promoCodes = await db.promoCode.findMany({
    where: { companyId: company.id },
    orderBy: { createdAt: "desc" },
    take: PROMO_CODES_LIMIT,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{dict.title}</h1>
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{dict.subtitle}</p>
      </div>

      <PromoCodeForm />

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-ink-soft dark:text-ink-soft-dark">{dict.listTitle}</h2>
        {promoCodes.length === 0 ? (
          <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{dict.noneYet}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {promoCodes.map((promoCode) => (
              <PromoCodeRow
                key={promoCode.id}
                id={promoCode.id}
                code={promoCode.code}
                label={promoCode.label}
                redemptionCount={promoCode.redemptionCount}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
