import { Card, CardContent } from '@/components/ui/card'
import { LABELS } from '@/lib/consts'

const GUIDE_STEPS = [
  LABELS.SETTINGS_PROFILE_GUIDE_STEP_1,
  LABELS.SETTINGS_PROFILE_GUIDE_STEP_2,
  LABELS.SETTINGS_PROFILE_GUIDE_STEP_3,
  LABELS.SETTINGS_PROFILE_GUIDE_STEP_4,
  LABELS.SETTINGS_PROFILE_GUIDE_STEP_5,
]

export function ProfileTelegramGuide() {
  return (
    <Card className="mb-6 border-2 border-[#C5CBE3] bg-[#4056A1]/5 shadow-sm">
      <CardContent className="space-y-3 p-4 sm:p-5">
        <h2 className="font-serif text-lg font-semibold text-primary">
          {LABELS.SETTINGS_PROFILE_GUIDE_TITLE}
        </h2>
        <p className="text-sm text-muted-foreground">{LABELS.SETTINGS_PROFILE_GUIDE_INTRO}</p>
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-[#333333]">
          {GUIDE_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="text-xs text-muted-foreground">{LABELS.SETTINGS_PROFILE_GUIDE_FOOTER}</p>
      </CardContent>
    </Card>
  )
}
