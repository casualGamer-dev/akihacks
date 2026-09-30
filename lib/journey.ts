/** The home page is one boat trip down the river: STOPS docks, the boat sails between them on a button press. */
export const STOPS = 7;
export const Z_START = 24;
export const Z_END = -60;

export const stopZ = (i: number) => Z_START + (i / (STOPS - 1)) * (Z_END - Z_START);
