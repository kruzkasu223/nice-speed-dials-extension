import { Grid } from "~/components/Grid"
import { useAppTheme } from "~/useAppTheme"

export const App = () => {
  useAppTheme()

  return (
    <div class="grid h-full min-h-screen w-full grid-rows-[auto_1fr] place-items-center gap-2 bg-(--app-background-color,#2c2124) bg-no-repeat p-4 [background-image:var(--app-background-image,none)] bg-position-(--app-background-position,auto) bg-size-(--app-background-size,auto) transition-colors">
      <Grid />
    </div>
  )
}
