import BigNumber from "bignumber.js";

// ----------------
// MATH
// ----------------

export const PERCENTAGE_FACTOR = "10000";
export const HALF_PERCENTAGE = "5000";
export const WAD = Math.pow(10, 18).toString();
export const HALF_WAD = new BigNumber(WAD).multipliedBy(0.5).toString();
export const RAY = new BigNumber(10).exponentiatedBy(27).toFixed();
export const HALF_RAY = new BigNumber(RAY).multipliedBy(0.5).toFixed();
export const WAD_RAY_RATIO = Math.pow(10, 9).toString();
export const oneEther = new BigNumber(Math.pow(10, 18));
export const decimal6Price = new BigNumber(Math.pow(10, 30));
export const decimal8Price = new BigNumber(Math.pow(10, 28));
export const decimal18Price = new BigNumber(Math.pow(10, 18));
export const decimal8 = new BigNumber(Math.pow(10, 8));
export const decimal6 = new BigNumber(Math.pow(10, 6));
export const oneRay = new BigNumber(Math.pow(10, 27));
export const MAX_UINT_AMOUNT =
  "115792089237316195423570985008687907853269984665640564039457584007913129639935";
export const ONE_YEAR = "31536000";
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
export const ONE_ADDRESS = "0x0000000000000000000000000000000000000001";
export const NATIVE_TOKEN = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
// ----------------
// PROTOCOL GLOBAL PARAMS
// ----------------
export const OPTIMAL_UTILIZATION_RATE = new BigNumber(0.8).times(RAY);
export const EXCESS_UTILIZATION_RATE = new BigNumber(0.2).times(RAY);
export const AAVE_REFERRAL = "0";

export const PREFIX = "Chfry ";
export const CPREFIX = "p";
export const DECIMAL18 = 18;
export const DECIMAL8 = 8;
export const DECIMAL6 = 6;
export const INITIALEXCHANGERATEMANTISSA_6 = "200000000000000"; //USDT, USDC
export const INITIALEXCHANGERATEMANTISSA_8 = "20000000000000000"; //WBTC
export const INITIALEXCHANGERATEMANTISSA_18 = "200000000000000000000000000"; //WETH, SUSHI, 1INCH, BNT, DAI
export const BECOMEIMPLEMENTATIONdATA = "0x00";

export const APPROVE_MaX = new BigNumber(
  "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
  16
).toFixed();
export const ONEINCH_ROUTER = "0x1111111254fb6c44bAC0beD2854e76F90643097d"; //v4'

export const createBigNumber18 = (v: any) => {
  return new BigNumber(v).multipliedBy(oneEther).toFixed();
};

export const trunkMatissa18 = (v: any) => {
  return new BigNumber(v).dividedBy(oneEther).toFixed();
};

export const createBigNumber8 = (v: any) => {
  return new BigNumber(v).multipliedBy(decimal8).toFixed();
};

export const trunkMatissa8 = (v: any) => {
  return new BigNumber(v).dividedBy(decimal8).toFixed();
};

export const createBigNumber6 = (v: any) => {
  return new BigNumber(v).multipliedBy(decimal6).toFixed();
};

export const trunkMatissa6 = (v: any) => {
  return new BigNumber(v).dividedBy(decimal6).toFixed();
};

export const INITIALAMOUNT = new BigNumber(10000000).toFixed(); //1000w
