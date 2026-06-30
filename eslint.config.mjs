import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";

const compat = new FlatCompat({
  recommendedConfig: js.configs.recommended
});

const eslintConfig = [
  {
    ignores: [".next/**", "node_modules/**", "storage/**", "coverage/**", "next-env.d.ts"]
  },
  ...compat.extends("next/core-web-vitals", "next/typescript")
];

export default eslintConfig;
