const path = require("path");
const { DATA_PATH } = require("./const");

const createDataPath = (dir) => path.join(DATA_PATH, dir);

module.exports = {
  createDataPath,
};
