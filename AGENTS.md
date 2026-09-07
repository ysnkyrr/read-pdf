# Read Fatura engineering contract

## Expo SDK
Expo has changed. Before writing framework or native-module code, read the exact SDK 57 documentation at https://docs.expo.dev/versions/v57.0.0/ and prefer Expo/React Native idioms for this version.

## Moonlinea Product Experience System
This product belongs to Moonlinea Creative. Treat the Moonlinea Product Experience System as the source of truth for interaction and behavior.

MUST:
- Keep one primary intent per screen and normally one primary CTA.
- Use reusable MoonPress behavior for interactive cards and primary buttons.
- Important actions follow Press -> Acknowledge -> Commit -> Result.
- Use MoonJourney/MoonProgress for meaningful multi-step progress; do not rely on percentage alone.
- Consider MoonReveal for first-use learning and important discoveries, not routine help.
- Keep motion fast, controlled, physical, and low-overshoot.
- Provide loading, empty, error, warning, and completion states where relevant.
- Respect accessibility, reduced motion, and operation without haptics.
- Keep product theme separate from Moonlinea Core behavior.

MUST NOT:
- Add random per-screen interaction patterns.
- Use generic native alerts as the primary solution for important decisions.
- Add excessive gradients, blur, bounce, confetti, competing primary CTAs, or long tutorial flows.

## Internationalization
All user-visible application copy must come from i18n resources. Do not hard-code UI copy in screens/components.

Supported locales:
- tr
- en
- es
- pt
- fr
- de
- ar
- ru
- hi
- id
- zh-CN

Keep layouts RTL-safe for Arabic and use locale-aware formatting for dates, numbers, and currencies.

## Product architecture
Keep reusable experience code under `src/moonlinea/` and product features under `src/features/`. Do not duplicate MoonPress, haptic, motion, decision, or progress behavior inside individual screens.
