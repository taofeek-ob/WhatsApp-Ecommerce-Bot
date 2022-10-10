"use strict";
const request = require("request");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const { createInvoice } = require("./createInvoice.js");
// const invoice = require("./invoice.js");

module.exports = class EcommerceStore {
  constructor() {}

  async _fetchAssistant(endpoint) {
    return new Promise((resolve, reject) => {
      request.get(
        `https://fakestoreapi.com${endpoint ? endpoint : "/"}`,
        (error, res, body) => {
          try {
            if (error) {
              reject(error);
            } else {
              resolve({
                status: "success",
                data: JSON.parse(body),
              });
            }
          } catch (error) {
            reject(error);
          }
        }
      );
    });
  }

  async paymentLinks(price, recipientNumber, cartItems, address) {
    var options = {
      method: "POST",
      url: "https://api.paystack.co/transaction/initialize",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "customer@email.com",
        amount: price * 50000,

        metadata: {
          custom_fields: [
            {
              display_name: "Mobile Number",
              variable_name: "mobile_number",
              value: recipientNumber,
            },
            {
              display_name: "Items Purchased",
              variable_name: "items_purchased",
              value: JSON.stringify(cartItems),
            },
            {
              display_name: "Delivery Address",
              variable_name: "delivery_address",
              value: address,
            },
          ],
        },
      }),
    };
    return new Promise((resolve, reject) => {
      request.post(options, (error, res, body) => {
        try {
          if (error) {
            reject(error);
          } else {
            resolve({
              status: "true",
              data: JSON.parse(body),
            });
          }
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  async paymentVerify(ref) {
    var options = {
      url: `https://api.paystack.co/transaction/verify/${ref}`,
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
        "cache-control": "no-cache",
      },
      formData: {},
    };
    return new Promise((resolve, reject) => {
      request.get(options, (error, res, body) => {
        try {
          if (error) {
            reject(error);
          } else {
            resolve({
              status: "true",
              data: JSON.parse(body),
            });
          }
        } catch (error) {
          reject(error);
        }
      });
    });
  }
  //HGHH
  async getProductLink(price, recipientNumber, cartItems, address) {
    return await this.paymentLinks(price, recipientNumber, cartItems, address);
  }
  async getProductVerify(ref) {
    console.log(ref);
    return await this.paymentVerify(ref);
  }
  async getProductv(price) {
    let lin = await this.paymentLinks(price);

    return lin.data.data.authorization_url;
  }
  async getProductById(productId) {
    return await this._fetchAssistant(`/products/${productId}`);
  }
  async getAllCategories() {
    return await this._fetchAssistant("/products/categories?limit=100");
  }
  async getProductsInCategory(categoryId) {
    return await this._fetchAssistant(
      `/products/category/${categoryId}?limit=10`
    );
  }

  generatePDFInvoice({ order_details, file_path }) {
    const doc = new PDFDocument();
    doc.pipe(fs.createWriteStream(file_path));
    doc.fontSize(25);
    doc.text(order_details, 100, 100);
    doc.end();
    return;
  }

  generateInvoice(invoice, path) {
    createInvoice(invoice, path);
  }

  generateRandomGeoLocation() {
    let storeLocations = [
      {
        latitude: 44.985613,
        longitude: 20.1568773,
        address: "New Castle",
      },
      {
        latitude: 36.929749,
        longitude: 98.480195,
        address: "Glacier Hill",
      },
      {
        latitude: 28.91667,
        longitude: 30.85,
        address: "Buena Vista",
      },
    ];
    return storeLocations[Math.floor(Math.random() * storeLocations.length)];
  }
};
