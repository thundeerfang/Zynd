export const INPUT_RULES = {
  email: {
    minLength: 5,
    maxLength: 254,
    pattern: "[^\\s@]+@[^\\s@]+\\.[^\\s@]+",
    title: "Enter a valid email address (5–254 characters).",
  },
  otp: {
    minLength: 6,
    maxLength: 6,
    pattern: "[0-9]{6}",
    title: "Enter exactly 6 digits.",
  },
  password: {
    minLength: 8,
    maxLength: 128,
    title: "Password must be 8–128 characters.",
  },
} as const;

export type InputRuleKey = keyof typeof INPUT_RULES;

export function inputRuleProps(key: InputRuleKey) {
  const rule = INPUT_RULES[key];
  const props: {
    minLength?: number;
    maxLength: number;
    pattern?: string;
    title: string;
  } = {
    maxLength: rule.maxLength,
    title: rule.title,
  };

  if ("minLength" in rule) {
    props.minLength = rule.minLength;
  }
  if ("pattern" in rule) {
    props.pattern = rule.pattern;
  }

  return props;
}

export function clampToMaxLength(value: string, key: InputRuleKey): string {
  return value.slice(0, INPUT_RULES[key].maxLength);
}

export function digitsOnly(value: string, key: InputRuleKey): string {
  return value.replace(/\D/g, "").slice(0, INPUT_RULES[key].maxLength);
}
