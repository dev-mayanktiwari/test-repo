const express = require("express");
const authMiddleware = require("../middleware");
const { Account, User } = require("../db");
const { default: mongoose } = require("mongoose");
const { number } = require("zod");

const router = express.Router();

router.get("/balance", authMiddleware, async (req, res) => {
  const userId = req.userId;

  try {
    const user = await Account.findOne({
      userId,
    });
    return res.status(200).json({
      balance: user.balance,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

router.post("/transfer", authMiddleware, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  const { amount, to } = req.body;
  const amountNumber = parseFloat(amount);

  if (isNaN(amountNumber) || amount < 0) {
    await session.abortTransaction();
    return res.status(400).json({
      error: "Amount must be valid.",
    });
  }

  const account = await Account.findOne({ userId: req.userId }).session(
    session
  );

  if (!account || account.balance < amount) {
    await session.abortTransaction();
    return res.status(400).json({
      error: "Insufficient balance for transfer.",
    });
  }

  const receiverAccount = await Account.findOne({ userId: to }).session(session);
  if (!receiverAccount) {
    await session.abortTransaction();
    return res.status(400).json({
      error: "Recipient not found.",
    });
  }

  await Account.updateOne(
    { userId: req.userId },
    { $inc: { balance: -amount } }
  ).session(session);
  await Account.updateOne(
    { userId: to },
    { $inc: { balance: amount } }
  ).session(session);

  await session.commitTransaction();
  return res.status(200).json({
    msg: "Transfer successfull",
  });
});
module.exports = router;
