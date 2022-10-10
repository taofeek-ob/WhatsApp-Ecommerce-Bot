"use strict";
const router = require("express").Router();

const WhatsappCloudAPI = require("whatsappcloudapi_wrapper");
const Whatsapp = new WhatsappCloudAPI({
  accessToken: process.env.Meta_WA_accessToken,
  senderPhoneNumberId: process.env.Meta_WA_SenderPhoneNumberId,
  WABA_ID: process.env.Meta_WA_wabaId,
});

router.get("/meta_wa_callbackurl", (req, res) => {
  try {
    // console.log("GET: Someone is pinging me!");

    let mode = req.query["hub.mode"];
    let token = req.query["hub.verify_token"];
    let challenge = req.query["hub.challenge"];

    if (
      mode &&
      token &&
      mode === "subscribe" &&
      process.env.Meta_WA_VerifyToken === token
    ) {
      return res.status(200).send(challenge);
    } else {
      return res.sendStatus(403);
    }
  } catch (error) {
    console.error({ error });
    return res.sendStatus(500);
  }
});

const EcommerceStore = require("./../utils/ecommerce_store.js");
let Store = new EcommerceStore();
const CustomerSession = new Map();

router.post("/meta_wa_callbackurl", async (req, res) => {
  try {
    let data = Whatsapp.parseMessage(req.body);

    if (data?.isMessage) {
      let incomingMessage = data.message;
      let recipientPhone = incomingMessage.from.phone; // extract the phone number of sender
      let recipientName = incomingMessage.from.name;
      let typeOfMsg = incomingMessage.type; // extract the type of message (some are text, others are images, others are responses to buttons etc...)
      let message_id = incomingMessage.message_id; // extract the message id

      if (!CustomerSession.get(recipientPhone)) {
        CustomerSession.set(recipientPhone, {
          cart: [],
          reference: "",
          link: "",
          delivery: "",
        });
      }
      // const invoice = {
      //   shipping: {
      //     name: recipientName,
      //     address: "1234 Main Street",
      //   },

      //   paid: 0,
      //   invoice_nr: 1234,
      // };
      let addToCart = async ({ product_id, recipientPhone }) => {
        let product = await Store.getProductById(product_id);

        if (product.status === "success") {
          CustomerSession.get(recipientPhone).cart.push(product.data);
        }
      };

      let listOfItemsInCart = ({ recipientPhone }) => {
        let total = 0;
        let products = CustomerSession.get(recipientPhone).cart;
        total = products.reduce((acc, product) => acc + product.price, total);
        let count = products.length;
        return { total, products, count };
      };

      let removeFromCart = async ({ product_id, recipientPhone }) => {
        let newCart = CustomerSession.get(recipientPhone).cart.filter(
          (item) => {
            return item.id != product_id;
          }
        );

        CustomerSession.get(recipientPhone).cart = newCart;
      };

      let clearCart = ({ recipientPhone }) => {
        CustomerSession.get(recipientPhone).cart = [];
        CustomerSession.get(recipientPhone).reference = "";
        CustomerSession.get(recipientPhone).link = "";
        CustomerSession.get(recipientPhone).delivery = "";
      };

      if (typeOfMsg === "text_message") {
        let txt = incomingMessage.text.body;
        if (txt.startsWith("Delivery Address:")) {
          CustomerSession.get(recipientPhone).delivery = txt
            .split(" ")
            .slice(2)
            .join(" ");
          await Whatsapp.sendSimpleButtons({
            recipientPhone: recipientPhone,
            message: `Click Pay to continue, .\n\n`,
            message_id,
            listOfButtons: [
              {
                title: "Pay 🛍️",
                id: `pay`,
              },
            ],
          });
        } else {
          await Whatsapp.sendSimpleButtons({
            message: `Hey ${recipientName}, \nYou are speaking to a chatbot.\nWhat do you want to do next?`,
            recipientPhone: recipientPhone,
            listOfButtons: [
              {
                title: "View some products",
                id: "see_categories",
              },
              {
                title: "Speak to a human",
                id: "speak_to_human",
              },
            ],
          });
        }
      }

      if (typeOfMsg === "simple_button_message") {
        let button_id = incomingMessage.button_reply.id;

        if (button_id.startsWith("add_to_cart_")) {
          let product_id = button_id.split("add_to_cart_")[1];
          await addToCart({ recipientPhone, product_id });
          let numberOfItemsInCart = listOfItemsInCart({ recipientPhone }).count;

          await Whatsapp.sendSimpleButtons({
            message: `Your cart has been updated.\nNumber of items in cart: ${numberOfItemsInCart}.\n\nWhat do you want to do next?`,
            recipientPhone: recipientPhone,
            listOfButtons: [
              {
                title: "Checkout 🛍️",
                id: `checkout`,
              },
              {
                title: "See more products",
                id: "see_categories",
              },
              {
                title: "View Cart🛒",
                id: "view_cart",
              },
            ],
          });
        }

        if (button_id === "remove") {
          let finalBill = listOfItemsInCart({ recipientPhone });

          let invoiceText = `List of items in your cart:\n`;

          finalBill.products.forEach((item, index) => {
            let serial = index + 1;
            invoiceText += `\n#${serial}: ${item.title} @ $${item.price}`;
          });

          let listOfSections = [
            {
              title: `Select product`,
              rows: finalBill.products
                .map((product) => {
                  let id = `remove_from_cart_${product.id}`.substring(0, 256);
                  let title = product.title.substring(0, 15);
                  let description =
                    `${product.price}\n${product.description}`.substring(0, 21);

                  return {
                    id,
                    title: `${title}...`,
                    description: `$${description}...`,
                  };
                })
                .slice(0, 10),
            },
          ];

          await Whatsapp.sendRadioButtons({
            recipientPhone: recipientPhone,
            headerText: "Modify Cart",
            bodyText: invoiceText,
            footerText: "Powered by: BMI LLC",
            listOfSections,
          });

          await Whatsapp.sendSimpleButtons({
            recipientPhone: recipientPhone,
            message: `Or .\n\n`,
            message_id,
            listOfButtons: [
              {
                title: "Checkout 🛍️",
                id: `checkout`,
              },
              {
                title: "See more products",
                id: "see_categories",
              },
              {
                title: "View Cart🛒",
                id: "view_cart",
              },
            ],
          });
        }

        if (button_id === "view_cart") {
          let finalBill = listOfItemsInCart({ recipientPhone });
          let invoiceText = `List of items in your cart:\n`;

          finalBill.products.forEach((item, index) => {
            let serial = index + 1;
            invoiceText += `\n#${serial}: ${item.title} @ $${item.price}`;
          });

          invoiceText += `\n\nTotal: $${finalBill.total}`;

          await Whatsapp.sendText({
            message: invoiceText,
            recipientPhone: recipientPhone,
          });

          await Whatsapp.sendSimpleButtons({
            recipientPhone: recipientPhone,
            message: `Which do you want to do, .\n\n`,
            message_id,
            listOfButtons: [
              {
                title: "Remove From Cart",
                id: `remove`,
              },
              {
                title: "See more products",
                id: "see_categories",
              },
              {
                title: "Checkout 🛍️",
                id: `checkout`,
              },
            ],
          });
        }

        if (button_id === "checkout") {
          await Whatsapp.sendText({
            message:
              "Enter Delivery Address \n\n Follow this format: \n\n 'Delivery Address: Your address....'",
            recipientPhone: recipientPhone,
          });
        }

        if (button_id === "pay") {
          let finalBill = listOfItemsInCart({ recipientPhone });
          let invoiceText = `List of items in your cart:\n`;
          let goods = [];

          finalBill.products.map((item, index) => {
            return goods.push({
              item: item.title.substring(0, 20),
              category: item.category,
              quantity: 1,
              amount: item.price,
            });
          });

          finalBill.products.forEach((item, index) => {
            let serial = index + 1;
            invoiceText += `\n#${serial}: ${item.title} @ $${item.price}`;
          });

          invoiceText += `\n\nTotal: $${finalBill.total}`;

          await Whatsapp.sendText({
            message: invoiceText,
            recipientPhone: recipientPhone,
          });

          let linked = await Store.getProductLink(
            finalBill.total,
            recipientPhone,
            goods,
            CustomerSession.get(recipientPhone).delivery
          );

          CustomerSession.get(recipientPhone).reference =
            linked.data.data.reference;
          CustomerSession.get(recipientPhone).link =
            linked.data.data.authorization_url;

          let link = CustomerSession.get(recipientPhone).link;

          const newInvoice = {
            shipping: {
              name: recipientName,
              address: CustomerSession.get(recipientPhone).delivery,
            },
            items: [...goods],
            subtotal: finalBill.total,
            paid: 0,
            invoice_reference: CustomerSession.get(recipientPhone).reference,
          };

          console.log(CustomerSession.get(recipientPhone).delivery);
          console.log(newInvoice);

          Store.generateInvoice(
            newInvoice,
            `./invoice_${recipientName}_${
              CustomerSession.get(recipientPhone).reference
            }_unpaid.pdf`
          );

          await Whatsapp.sendSimpleButtons({
            recipientPhone: recipientPhone,
            message: `Thank you for shopping with us, ${recipientName}.\n\n Pay with PayStack: ${link} \n\n `,
            message_id,
            listOfButtons: [
              {
                title: "I have Paid",
                id: "verify_payment",
              },
            ],
          });
        }
        if (button_id === "verify_payment") {
          let finalBill = listOfItemsInCart({ recipientPhone });

          let ref = CustomerSession.get(recipientPhone).reference;

          let invoiceText = `List of items in your cart:\n`;

          finalBill.products.forEach((item, index) => {
            let serial = index + 1;
            invoiceText += `\n#${serial}: ${item.title} @ $${item.price}`;
          });

          invoiceText += `\n\nTotal: $${finalBill.total}`;

          await Whatsapp.sendText({
            message: invoiceText,
            recipientPhone: recipientPhone,
          });

          const result = await Store.getProductVerify(ref);

          let goods = [];

          finalBill.products.map((item, index) => {
            return goods.push({
              item: item.title.substring(0, 20),
              category: item.category,
              quantity: 1,
              amount: item.price,
            });
          });

          if (result.data.data.status === "success") {
            let finalBill = listOfItemsInCart({ recipientPhone });

            const newInvoice = {
              shipping: {
                name: recipientName,
                address: CustomerSession.get(recipientPhone).delivery,
              },
              items: [...goods],
              subtotal: finalBill.total,
              paid: finalBill.total,
              invoice_reference: ref,
            };

            console.log(newInvoice);

            Store.generateInvoice(
              newInvoice,
              `./invoice_${recipientName}_${ref}_paid.pdf`
            );
            await Whatsapp.sendSimpleButtons({
              recipientPhone: recipientPhone,
              message: `Your payment has been confirmed. \n\nThank you for shopping with us, ${recipientName}.\n\n `,
              message_id,
              listOfButtons: [
                {
                  title: "Print my invoice",
                  id: "print_invoice",
                },
              ],
            });
          } else {
            await Whatsapp.sendText({
              message: "Payment has not been confirmed yet.",
              recipientPhone: recipientPhone,
            });

            let link = CustomerSession.get(recipientPhone).link;

            await Whatsapp.sendSimpleButtons({
              recipientPhone: recipientPhone,
              message: `Thank you for shopping with us, ${recipientName}.\n\n Pay with PayStack: ${link} \n\n `,
              message_id,
              listOfButtons: [
                {
                  title: "I have Paid",
                  id: "verify_payment",
                },
              ],
            });
          }
        }

        if (button_id === "print_invoice") {
          // // Send the PDF invoice
          // await Whatsapp.sendDocument({
          //   recipientPhone: recipientPhone,
          //   caption: `Mom-N-Pop Shop invoice #${recipientName}`,
          //   file_path: `./invoice_${recipientName}.pdf`,
          // });
          // Send the PDF invoice
          await Whatsapp.sendDocument({
            recipientPhone: recipientPhone,
            caption: `PAID - TS Accessories #${recipientName}`,
            file_path: `./invoice_${recipientName}_${
              CustomerSession.get(recipientPhone).reference
            }_paid.pdf`,
          });

          // Send the location of our pickup station to the customer, so they can come and pick up their order
          let warehouse = Store.generateRandomGeoLocation();

          await Whatsapp.sendText({
            recipientPhone: recipientPhone,
            message: `Your order would be delivered to the address provided. Or you can come and pick it from our store:`,
          });

          await Whatsapp.sendLocation({
            recipientPhone,
            latitude: warehouse.latitude,
            longitude: warehouse.longitude,
            address: warehouse.address,
            name: "TaoShoke Retail",
          });

          clearCart({ recipientPhone });
        }

        if (button_id === "speak_to_human") {
          await Whatsapp.sendText({
            recipientPhone: recipientPhone,
            message: `Arguably, chatbots are faster than humans.\nCall my human with the below details:`,
          });

          await Whatsapp.sendContact({
            recipientPhone: recipientPhone,
            contact_profile: {
              addresses: [
                {
                  city: "Lagos",
                  country: "Nigeria",
                },
              ],
              name: {
                first_name: "Taofeek",
                last_name: "Bakare",
              },
              org: {
                company: "TaoShoke Retail",
              },
              phones: [
                {
                  phone: "23490166906",
                },
              ],
            },
          });
        }

        if (button_id === "see_categories") {
          let categories = await Store.getAllCategories();
          await Whatsapp.sendSimpleButtons({
            message: `We have several categories.\nChoose one of them.`,
            recipientPhone: recipientPhone,
            listOfButtons: categories.data
              .map((category) => ({
                title: category,
                id: `category_${category}`,
              }))
              .slice(0, 3),
          });
        }

        if (button_id.startsWith("category_")) {
          let selectedCategory = button_id.split("category_")[1];
          let listOfProducts = await Store.getProductsInCategory(
            selectedCategory
          );

          let listOfSections = [
            {
              title: `🏆 Top 3: ${selectedCategory}`.substring(0, 24),
              rows: listOfProducts.data
                .map((product) => {
                  let id = `product_${product.id}`.substring(0, 256);
                  let title = product.title.substring(0, 21);
                  let description =
                    `${product.price}\n${product.description}`.substring(0, 68);

                  return {
                    id,
                    title: `${title}...`,
                    description: `$${description}...`,
                  };
                })
                .slice(0, 10),
            },
          ];

          await Whatsapp.sendRadioButtons({
            recipientPhone: recipientPhone,
            headerText: `#BlackFriday Offers: ${selectedCategory}`,
            bodyText: `Our Santa 🎅🏿 has lined up some great products for you based on your previous shopping history.\n\nPlease select one of the products below:`,
            footerText: "Powered by: BMI LLC",
            listOfSections,
          });
        }
      }

      if (typeOfMsg === "radio_button_message") {
        let selectionId = incomingMessage.list_reply.id; // the customer clicked and submitted a radio button

        if (selectionId.startsWith("product_")) {
          let product_id = selectionId.split("_")[1];
          let product = await Store.getProductById(product_id);
          const {
            price,
            title,
            description,
            category,
            image: imageUrl,
            rating,
          } = product.data;

          let emojiRating = (rvalue) => {
            rvalue = Math.floor(rvalue || 0); // generate as many star emojis as whole number ratings
            let output = [];
            for (var i = 0; i < rvalue; i++) output.push("⭐");
            return output.length ? output.join("") : "N/A";
          };

          let text = `_Title_: *${title.trim()}*\n\n\n`;
          text += `_Description_: ${description.trim()}\n\n\n`;
          text += `_Price_: $${price}\n`;
          text += `_Category_: ${category}\n`;
          text += `${rating?.count || 0} shoppers liked this product.\n`;
          text += `_Rated_: ${emojiRating(rating?.rate)}\n`;

          await Whatsapp.sendImage({
            recipientPhone,
            url: imageUrl,
            caption: text,
          });

          await Whatsapp.sendSimpleButtons({
            message: `Here is the product, what do you want to do next?`,
            recipientPhone: recipientPhone,
            listOfButtons: [
              {
                title: "Add to cart🛒",
                id: `add_to_cart_${product_id}`,
              },
              {
                title: "View Cart🛒",
                id: "view_cart",
              },
              {
                title: "See more products",
                id: "see_categories",
              },
            ],
          });
        }

        if (selectionId.startsWith("remove_from_cart_")) {
          let product_id = selectionId.split("remove_from_cart_")[1];
          await removeFromCart({ recipientPhone, product_id });

          await Whatsapp.sendText({
            message: `Product has been removed and your cart has been updated.`,
            recipientPhone: recipientPhone,
          });

          let finalBill = listOfItemsInCart({ recipientPhone });

          let invoiceText = `List of items in your cart:\n`;

          finalBill.products.forEach((item, index) => {
            let serial = index + 1;
            invoiceText += `\n#${serial}: ${item.title} @ $${item.price}`;
          });

          invoiceText += `\n\nTotal: $${finalBill.total}`;

          await Whatsapp.sendText({
            message: invoiceText,
            recipientPhone: recipientPhone,
          });

          await Whatsapp.sendSimpleButtons({
            recipientPhone: recipientPhone,
            message: `What do you want to do next?`,
            message_id,
            listOfButtons: [
              {
                title: "See more products",
                id: "see_categories",
              },
              {
                title: "Checkout 🛍️",
                id: "checkout",
              },
              {
                title: "Remove From Cart 🛍️",
                id: "remove",
              },
            ],
          });
        }
      }
      await Whatsapp.markMessageAsRead({ message_id });
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error({ error });
    return res.sendStatus(500);
  }
});
module.exports = router;
