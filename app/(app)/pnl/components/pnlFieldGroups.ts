export interface PnlFieldDef {
  key: string;
  label: string;
}

export interface PnlFieldGroup {
  title: string;
  fields: PnlFieldDef[];
}

// Generic expense groups rendered dynamically in the P&L drawer (each gets a
// subtotal row automatically when it has more than one field).
export const PNL_FIELD_GROUPS: PnlFieldGroup[] = [
  {
    title: "Office Maintenance",
    fields: [
      { key: "omGarbageCharges", label: "Garbage charges (BBMP)" },
      { key: "omSecurityCharges", label: "Security charges / Maintenance charges" },
      { key: "omBroomsMopEtc", label: "Brooms / Mop / Mat / Airfreshener / Dustbin" },
      { key: "omShoeUniforms", label: "Shoe / Uniforms" },
      { key: "omPlasticItems", label: "Plastic Items / Containers" },
      { key: "omPestControl", label: "Pest control" },
      { key: "omOthers", label: "Others" },
    ],
  },
  {
    title: "Repair & Maintenance",
    fields: [
      { key: "rmDisplayMachine", label: "Display Machine Repair" },
      { key: "rmFreezer", label: "Freezer Repair / VC Cooler / VC Freezer" },
      { key: "rmAc", label: "AC Repair / AMC" },
      { key: "rmComputer", label: "Computer / CPU Repair" },
      { key: "rmMixie", label: "Mixie Repair" },
      { key: "rmMicroOven", label: "Micro oven Repair" },
      { key: "rmElectrical", label: "Electrical Repair" },
      { key: "rmLight", label: "Light / Repair" },
      { key: "rmGenerator", label: "Generator Repair / AMC" },
      { key: "rmSandwichCone", label: "Sandwich machine / Cone machine" },
      { key: "rmOthers", label: "Others" },
    ],
  },
  {
    title: "Staff Salary",
    fields: [{ key: "staffSalary", label: "Staff Salary" }],
  },
  {
    title: "Staff Welfare",
    fields: [
      { key: "swFoodAllowance", label: "Food Allowance" },
      { key: "swLunch", label: "Lunch" },
      { key: "swRoomGas", label: "Room Gas" },
      { key: "swRoomElectricity", label: "Room Electricity charges" },
      { key: "swRoomWater", label: "Room water charges" },
      { key: "swRoomDrinkingWater", label: "Room Drinking water" },
      { key: "swOthers", label: "Others" },
    ],
  },
  {
    title: "Water Charges",
    fields: [
      { key: "wcDrinkingWater", label: "Drinking water charges" },
      { key: "wcParlourWaterEB", label: "Parlour Water EB" },
      { key: "wcWaterTanker", label: "Water Tanker charges" },
    ],
  },
  {
    title: "Diesel / Petrol",
    fields: [{ key: "dieselPetrol", label: "Diesel / Petrol" }],
  },
  {
    title: "Telephone Charges",
    fields: [{ key: "telephoneCharges", label: "Telephone Charges" }],
  },
  {
    title: "Bank Charges",
    fields: [{ key: "bankCharges", label: "Bank Charges" }],
  },
  {
    title: "Advertisement & Mkt Exp",
    fields: [
      { key: "advLiveRadio", label: "Live Radio Exp" },
      { key: "advLeaflets", label: "Leaflets (Printing & Distribution)" },
      { key: "advDiscountVouchers", label: "Discount / Gift Vouchers / others" },
      { key: "advApiIntegration", label: "API integration" },
    ],
  },
  {
    title: "Conveyance",
    fields: [
      { key: "cvAutoRapido", label: "Auto charges / Rapido" },
      { key: "cvBusMetroCab", label: "Bus fare / Metro / Cab" },
      { key: "cvVehiclePetrol", label: "Vehicle petrol" },
    ],
  },
  {
    title: "Printing & Stationery",
    fields: [
      { key: "psXeroxLamination", label: "Xerox / Laminations" },
      { key: "psNotebookPenMarker", label: "Note Book / Pen / Marker" },
      { key: "psCourierNewspaper", label: "Courier charges / Newspaper" },
    ],
  },
  {
    title: "Magazines & Periodicals",
    fields: [
      { key: "mpHijida", label: "Hijida" },
      { key: "mpPolice", label: "Police" },
    ],
  },
  {
    title: "Rates & Taxes",
    fields: [
      { key: "rtLicenses", label: "Trade, FSSAI, labour, General, Weighing scale licenses" },
      { key: "rtParlourInsurance", label: "Parlour Insurance" },
    ],
  },
  {
    title: "Royalty",
    fields: [{ key: "royalty", label: "Royalty" }],
  },
  {
    title: "Miscellaneous",
    fields: [{ key: "miscellaneous", label: "Miscellaneous" }],
  },
];
