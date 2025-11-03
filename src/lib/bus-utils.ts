/**
 * Shared bus utility functions that can be used on both client and server
 */

export const getOccupancyLabel = (status: string): string => {
  switch (status.toLowerCase()) {
    case "empty":
      return "Empty";
    case "many seats available":
      return "Many Seats";
    case "few seats available":
      return "Few Seats";
    case "standing room only":
      return "Standing Room";
    case "crushed standing room only":
      return "Full";
    case "not accepting passengers":
      return "Full";
    default:
      return status;
  }
};

export const getOccupancyColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case "empty":
      return "bg-green-100 text-green-800";
    case "many seats available":
      return "bg-green-100 text-green-800";
    case "few seats available":
      return "bg-yellow-100 text-yellow-800";
    case "standing room only":
      return "bg-orange-100 text-orange-800";
    case "crushed standing room only":
      return "bg-red-100 text-red-800";
    case "not accepting passengers":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};
