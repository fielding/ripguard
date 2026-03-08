export const erc20Abi = [
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export const testUsdcAbi = [
  {
    type: "function",
    name: "faucet",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

export const sablierLockupAbi = [
  {
    type: "function",
    name: "getStream",
    inputs: [{ name: "streamId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "sender", type: "address" },
          { name: "recipient", type: "address" },
          { name: "amounts", type: "tuple", components: [
            { name: "deposited", type: "uint128" },
            { name: "withdrawn", type: "uint128" },
            { name: "refunded", type: "uint128" },
          ]},
          { name: "token", type: "address" },
          { name: "startTime", type: "uint40" },
          { name: "endTime", type: "uint40" },
          { name: "cliffTime", type: "uint40" },
          { name: "cancelable", type: "bool" },
          { name: "wasCanceled", type: "bool" },
          { name: "transferable", type: "bool" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "withdrawableAmountOf",
    inputs: [{ name: "streamId", type: "uint256" }],
    outputs: [{ name: "withdrawableAmount", type: "uint128" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "withdrawMax",
    inputs: [
      { name: "streamId", type: "uint256" },
      { name: "to", type: "address" },
    ],
    outputs: [{ name: "withdrawnAmount", type: "uint128" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "statusOf",
    inputs: [{ name: "streamId", type: "uint256" }],
    outputs: [{ name: "status", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "createWithDurationsLL",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "sender", type: "address" },
          { name: "recipient", type: "address" },
          { name: "totalAmount", type: "uint128" },
          { name: "token", type: "address" },
          { name: "cancelable", type: "bool" },
          { name: "transferable", type: "bool" },
          { name: "shape", type: "string" },
          {
            name: "broker",
            type: "tuple",
            components: [
              { name: "account", type: "address" },
              { name: "fee", type: "uint256" },
            ],
          },
        ],
      },
      {
        name: "unlockAmounts",
        type: "tuple",
        components: [
          { name: "start", type: "uint128" },
          { name: "cliff", type: "uint128" },
        ],
      },
      {
        name: "durations",
        type: "tuple",
        components: [
          { name: "cliff", type: "uint40" },
          { name: "total", type: "uint40" },
        ],
      },
    ],
    outputs: [{ name: "streamId", type: "uint256" }],
    stateMutability: "payable",
  },
] as const;
