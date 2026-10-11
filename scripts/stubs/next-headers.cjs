module.exports = {
  async cookies() {
    return { get() {}, set() {} };
  },
  async headers() {
    return new Headers();
  },
};
