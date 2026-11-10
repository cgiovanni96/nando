import { createTheme } from "@mantine/core";

import { componentDefaults } from "./component-defaults";
import { tokens } from "./tokens";

export { cssVariablesResolver } from "./css-variables";

export const theme = createTheme({
  ...tokens,
  components: componentDefaults,
});
