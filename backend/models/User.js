const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      require: true,
      trim: true,
    },
    username: {
      type: String,
      require: true, //require = 필수값인지 체크하게 해줌
      trim: true,
      minlength: 2,
      maxlength: 30,
    },
    password: {
      type: String,
      require: true,
      select: false, //기본적으로 쿼리할 때 해당 필드를 포함하지 않음 ,보안: 비밀번호 같은 민감한 정보는 기본적으로 제외
    },
    isLoggedIn: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lastLoginAttempt: {
      type: Date,
    },
    ipAddress: {
      type: String,
      trim: true,
    },
    createAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    //자동으로 createdAt과 updatedAt 필드를 추가
    //문서가 생성되거나 수정될 때 시간 정보를 자동으로 기록
  }
);

const User = mongoose.model("User", userSchema);

module.exports = User;
