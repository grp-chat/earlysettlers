/**
 * Rising Kingdoms: Master Structure Registry
 * Logic: 
 * - Costs/Points: [First Build, Subsequent Builds] or [Static Value]
 * - Requirements: Must exist in team inventory to unlock
 * - Conversion: Consumes a specific building to create this one
 * - Specialty: Global buffs or passive resource logic
 */

const structures = {
  // --- HOUSING ---
  farm_house: {
    id: "farm_house",
    name: "Farm House",
    image: "https://i.postimg.cc/mkXkBXQ3/image-0-0.png",
    woodCost: [3], clayCost: [2], stoneCost: [1],
    points: [3],
    maxBuild: 99,
    requires: null
  },
  stone_house: {
    id: "stone_house",
    name: "Stone House",
    image: "https://i.postimg.cc/NFJFBJ1t/image-0-1.png",
    woodCost: [2], clayCost: [5],
    points: [3, 2], // 1st is 3pts, others are 2pts
    maxBuild: 99,
    requires: null
  },
  cottage: {
    id: "cottage",
    name: "Cottage",
    image: "https://i.postimg.cc/NMt54rsg/image_1715518150_15.png",
    woodCost: [2], clayCost: [2], stoneCost: [2],
    points: [3],
    maxBuild: 99,
    requires: null
  },
  holiday_house: {
    id: "holiday_house",
    name: "Holiday House",
    image: "https://i.postimg.cc/YSK9rmmY/image_0_23.png",
    woodCost: [2], clayCost: [2],
    points: [5],
    maxBuild: 3,
    requires: ["farm_house", "cooking_hearth", "stone_house"],
    conversion: { consumes: "stone_house", amount: 1 },
    specialText: "Farm House, Cooking Hearth, Stone House -1"
  },

  // --- PRODUCTION & RESOURCES ---
  lumber_mill: {
    id: "lumber_mill",
    name: "Lumber Mill",
    image: "https://i.postimg.cc/8CQ5prrv/image_0_26.png",
    woodCost: [3], clayCost: [1],
    points: [1],
    maxBuild: 99,
    specialty: { type: "passive", target: "wood", trigger: 4, bonus: 1 }, // Every 4th wood +1
    specialText: "Each 4 wood +1 wood"

  },
  silo: {
    id: "silo",
    name: "Silo",
    image: "https://i.postimg.cc/PqYCYMkF/image_1715518150_5.png",
    woodCost: [1], clayCost: [1], stoneCost: [3],
    points: [1],
    maxBuild: 99
  },
  windmill: {
    id: "windmill",
    name: "Windmill",
    image: "https://i.postimg.cc/0yL6zBhb/image_1598223373_1.png",
    woodCost: [1], clayCost: [1], stoneCost: [4],
    points: [3, 1],
    maxBuild: 99
  },
  well: {
    id: "well",
    name: "Well",
    image: "https://i.postimg.cc/pTvpZnWb/image_1715518150_13.png",
    woodCost: [1], stoneCost: [3],
    points: [1],
    maxBuild: 99
  },
  clay_oven: {
    id: "clay_oven",
    name: "Clay Oven",
    image:"https://i.postimg.cc/mgFkWSh7/image-0-25.png",
    clayCost: [2],
    points: [1],
    maxBuild: 99,
    requires: "cooking_hearth",
    capacity: { requiredBuilding: "cooking_hearth", ratio: 1 },
    specialText: "1 Clay Oven/ 1 Cooking Hearth"
  },

  // --- ANIMALS & OUTDOORS ---
  stable: {
    id: "stable",
    name: "Stable",
    image: "https://i.postimg.cc/XqHq4HwV/image_0_2.png",
    woodCost: [1], clayCost: [1], stoneCost: [1],
    points: [2, 1], // 1st is 2pts, others are 1pt
    maxBuild: 99
  },
  animal_pen: {
    id: "animal_pen",
    name: "Animal Pen",
    image: "https://i.postimg.cc/T2CpVwZx/image_0_8.png",
    woodCost: [2], clayCost: [2], stoneCost: [1],
    points: [2], // Becomes 3 if Pond exists
    maxBuild: 99
  },
  pond: {
    id: "pond",
    name: "Pond",
    image: "https://i.postimg.cc/Kv83wLnZ/image_458325939_3.png",
    stoneCost: [5],
    points: [1],
    maxBuild: 99,
    specialty: { type: "buff", target: "animal_pen", value: 1 },
    specialText: "All Animal Pens +1 point"
  },
  garden: {
    id: "garden",
    name: "Garden",
    image: "https://i.postimg.cc/024j44kC/image_0_12.png",
    woodCost: [1], clayCost: [1], stoneCost: [1],
    points: [1],
    maxBuild: 4
  },
  conservatory: {
    id: "conservatory",
    name: "Conservatory",
    image: "https://i.postimg.cc/G3QsXzsm/image_458325939_1.png",
    woodCost: [1], clayCost: [1], stoneCost: [5],
    points: [4],
    maxBuild: 99,
    requires: ["garden", "garden", "garden", "well"], // Needs 3 Gardens and 1 Well
    specialText: "GardenX3, WellX1"
  },

  // --- UTILITY & TRAVEL ---
  fishing_pier: {
    id: "fishing_pier",
    name: "Fishing Pier",
    image: "https://i.postimg.cc/59n6B0Zj/image-0-10.png",
    woodCost: [6], stoneCost: [3],
    points: [3],
    maxBuild: 2
  },
  boat: {
    id: "boat",
    name: "Boat",
    image: "https://i.postimg.cc/JhVnrBBq/image_0_24.png",
    woodCost: [1],
    points: [1],
    maxBuild: 4, // Logic must check: CurrentBoats < (FishingPiers * 2)
    requires: "fishing_pier",
    capacity: { requiredBuilding: "fishing_pier", ratio: 2 },
    specialText: "2 Boats/ 1 Fishing Pier"
  },
  carriage: {
    id: "carriage",
    name: "Carriage",
    image: "https://i.postimg.cc/HnsjGD83/image_1715518150_22.png",
    woodCost: [2],
    points: [1],
    maxBuild: 99,
    requires: "stable"
  },
  fences: {
    id: "fences",
    name: "Fences",
    image: "https://i.postimg.cc/BZMXT6Rd/image_0_7.png",
    woodCost: [5, 2], // 1st Wood cost is 5, then 2
    points: [2, 1],
    maxBuild: 99
  },

  // --- ESSENTIALS ---
  cooking_hearth: {
    id: "cooking_hearth",
    name: "Cooking Hearth",
    image: "https://i.postimg.cc/26x3X8y9/image_1715518150_3.png",
    woodCost: [1], clayCost: [1], stoneCost: [1],
    points: [1],
    maxBuild: 99
  },
  fireplace: {
    id: "fireplace",
    name: "Fireplace",
    image: "https://i.postimg.cc/fbmVmvhx/image_1715518150_4.png",
    woodCost: [1], stoneCost: [1],
    points: [1],
    maxBuild: 99
  },
  wine_cellar: {
    id: "wine_cellar",
    name: "Wine Cellar",
    image: "https://i.postimg.cc/7YZJd7gH/image_458325939_4.png",
    woodCost: [3], clayCost: [1], stoneCost: [1],
    points: [4],
    maxBuild: 1,
    requires: ["conservatory", "windmill", "silo"]
  }
};

// Export for use in Node.js
if (typeof module !== 'undefined') {
    module.exports = structures;
}