const buttonBase =
  "inline-flex cursor-pointer items-center justify-center rounded-md font-sans font-bold leading-none transition-colors disabled:cursor-wait disabled:opacity-80";

const buttonSizes = {
  sm: "h-7 gap-1.5 px-2.5 text-xs",
  md: "h-9 gap-1.5 px-3.5 text-sm",
  lg: "h-11 gap-2 px-4 text-base",
  iconSm: "size-8",
  iconMd: "size-9",
};

const buttonColors = {
  primary: "border border-[#2f6696] bg-[#2f6696] text-white hover:border-[#285985] hover:bg-[#285985]",
  secondary: "border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50",
  danger: "border border-red-700 bg-red-700 text-white hover:border-red-800 hover:bg-red-800",
  disabled: "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400 hover:border-slate-200 hover:bg-slate-100",
  header: "border border-white/25 bg-transparent text-white hover:border-white/45 hover:bg-white/10",
  ghostPrimary: "border border-transparent bg-transparent text-[#2f6696] hover:border-slate-200 hover:bg-slate-100",
  ghostMuted: "border border-transparent bg-transparent text-slate-500 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-700",
};

export const buttonStyles = {
  primary: `${buttonBase} ${buttonSizes.md} ${buttonColors.primary}`,
  primaryLarge: `${buttonBase} ${buttonSizes.lg} ${buttonColors.primary}`,
  primarySmall: `${buttonBase} ${buttonSizes.sm} ${buttonColors.primary}`,
  secondary: `${buttonBase} ${buttonSizes.md} ${buttonColors.secondary}`,
  secondaryLarge: `${buttonBase} ${buttonSizes.md} ${buttonColors.secondary}`,
  secondarySmall: `${buttonBase} ${buttonSizes.sm} ${buttonColors.secondary}`,
  danger: `${buttonBase} ${buttonSizes.md} ${buttonColors.danger}`,
  dangerSmall: `${buttonBase} ${buttonSizes.sm} ${buttonColors.danger}`,
  disabled: `${buttonBase} ${buttonSizes.md} ${buttonColors.disabled}`,
  disabledSmall: `${buttonBase} ${buttonSizes.sm} ${buttonColors.disabled}`,
  header: `${buttonBase} ${buttonSizes.md} ${buttonColors.header}`,
  iconPrimary: `${buttonBase} ${buttonSizes.iconMd} ${buttonColors.primary}`,
  iconEdit: `${buttonBase} ${buttonSizes.iconMd} ${buttonColors.ghostPrimary}`,
  iconClose: `${buttonBase} ${buttonSizes.iconMd} ${buttonColors.ghostMuted}`,
  iconDanger: `${buttonBase} ${buttonSizes.iconMd} ${buttonColors.danger}`,
  iconDisabled: `${buttonBase} ${buttonSizes.iconMd} ${buttonColors.disabled}`,
  pager: `${buttonBase} ${buttonSizes.md} ${buttonColors.secondary}`,
  pagerDisabled: `${buttonBase} ${buttonSizes.md} ${buttonColors.disabled}`,
  clearSearch:
    "absolute right-2 top-1/2 hidden size-6 -translate-y-1/2 cursor-pointer place-items-center rounded-md border border-transparent bg-transparent font-sans text-sm font-bold leading-none text-slate-400 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-700 group-hover:grid",
};

export const buttonGroups = {
  footer: "flex flex-wrap justify-end gap-2 border-t border-slate-200 px-4 py-3",
  modalFooter: "flex flex-wrap justify-end gap-2 border-t border-slate-200 p-4",
  toolbar: "flex flex-wrap items-center gap-2",
};
