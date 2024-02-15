FROM node:20 as build

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm i
COPY . .
RUN npm run build

FROM public.ecr.aws/lambda/nodejs:20 as final

ARG SERVICE_USER
ARG SERVICE_PASS

RUN microdnf install sudo tar git -y

RUN curl -fsSL https://get.pulumi.com > pulumi.sh && chmod +x pulumi.sh && ./pulumi.sh --install-root /opt

RUN git config --system credential.helper "/bin/bash /git_creds.sh"
RUN git config --system user.email "jconnell@pulumi.com"
RUN echo '#!/bin/bash' > /git_creds.sh 
RUN echo "sleep 1" >> /git_creds.sh 
RUN echo "echo username=$SERVICE_USER" >> /git_creds.sh 
RUN echo "echo password=$SERVICE_PASS" >> /git_creds.sh

# Copy function code
COPY --from=build /usr/src/app/package*.json ${LAMBDA_TASK_ROOT}/
COPY --from=build /usr/src/app/node_modules  ${LAMBDA_TASK_ROOT}/node_modules
COPY --from=build /usr/src/app/dist  ${LAMBDA_TASK_ROOT}

# Set the CMD to your handler (could also be done as a parameter override outside of the Dockerfile)
CMD [ "index.handler" ]